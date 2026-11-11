// Path check for a written-case pack. It plays the pack through the real engine and
// reports identifiers and counts only: no title, body, line or label ever enters a report,
// so a report is safe to read without spoiling the story it describes.
import {validateCasePack, validateOpening, createCaseState, applyCaseAction, gateAllows, CaseError} from './case-engine.js';

const OPENING_VERSION = 'paper-opening-2026-11-05-r2';
// Every opening the public page can hand over, plus a session started without one.
export const OPENINGS = [
  null,
  ...['precise', 'lie'].flatMap(choice => ['jonas', 'both', 'draft'].map(recipient => ({version: OPENING_VERSION, choice, recipient}))),
  ...['wait', 'refuse'].map(choice => ({version: OPENING_VERSION, choice, recipient: null})),
];
const ENGINE_FLAGS = {
  opening_imported: [true, false],
  opening_choice: ['none', 'precise', 'wait', 'refuse', 'lie'],
  opening_recipient: ['none', 'jonas', 'both', 'draft'],
};
const own = (value, key) => Object.hasOwn(value, key);
const captureName = key => key.replace(/\.revision\.\d+$/, '');
const emptyUse = () => ({flags: new Set(), materials: new Set(), captures: new Set(), kinds: new Set(), sources: false});
const absorb = (into, from) => {
  for (const name of ['flags', 'materials', 'captures', 'kinds']) from[name].forEach(item => into[name].add(item));
  into.sources ||= from.sources;
  return into;
};
function walkGates(gate, visit) {
  if (gate === undefined) return;
  if (own(gate, 'all')) gate.all.forEach(item => walkGates(item, visit));
  else if (own(gate, 'any')) gate.any.forEach(item => walkGates(item, visit));
  else if (own(gate, 'not')) walkGates(gate.not, visit);
  else visit(gate);
}

// What decides a session's future is small: flags and materials read by gates, materials an
// action shares, captures a receipt copies, receipt kinds a correction points back to, and
// whether any material is held when a form asks for sources. Everything below builds on that.
function analyse(pack) {
  const reads = {}, touches = {}, after = {};
  for (const [sceneId, scene] of Object.entries(pack.scenes)) {
    const read = reads[sceneId] = emptyUse(), touch = touches[sceneId] = emptyUse();
    const gate = value => walkGates(value, leaf => own(leaf, 'flag') ? read.flags.add(leaf.flag) : read.materials.add(leaf.hasMaterial));
    (scene.lines || []).forEach(line => gate(line.requires));
    after[sceneId] = new Set();
    for (const action of scene.actions) {
      gate(action.requires);
      if (action.target !== undefined) after[sceneId].add(action.target);
      const effects = action.effects || {};
      for (const share of effects.share || []) read.materials.add(share.materialId);
      if ((action.fields || []).some(field => field.type === 'materialRefs')) read.sources = true;
      if (effects.receipt?.fromCapture) read.captures.add(effects.receipt.fromCapture);
      if (effects.receipt?.relatesTo) read.kinds.add(effects.receipt.relatesTo);
      Object.keys(effects.set || {}).forEach(flag => touch.flags.add(flag));
      (effects.grant || []).forEach(id => touch.materials.add(id));
      if (effects.capture) touch.captures.add(effects.capture);
      if (effects.receipt) touch.kinds.add(effects.receipt.kind);
    }
    absorb(touch, read);
  }
  // A later scene never reads what no reachable scene reads, so it is left out of a state's
  // identity. This is exact, and it is what keeps independent choices from multiplying.
  const relevant = {};
  for (const sceneId of Object.keys(pack.scenes)) {
    const seen = new Set([sceneId]), pending = [sceneId], merged = emptyUse();
    while (pending.length) for (const next of after[pending.pop()]) if (!seen.has(next)) { seen.add(next); pending.push(next); }
    for (const id of seen) absorb(merged, reads[id]);
    relevant[sceneId] = {...merged, flags: [...merged.flags].sort()};
  }
  // Scenes that can return to one another form one component. Components come out of this
  // search last-first, so reversing gives an order in which every move leads forward.
  const index = new Map(), low = new Map(), stack = [], onStack = new Set(), components = [];
  const connect = sceneId => {
    index.set(sceneId, index.size); low.set(sceneId, index.get(sceneId)); stack.push(sceneId); onStack.add(sceneId);
    for (const next of after[sceneId]) {
      if (!index.has(next)) { connect(next); low.set(sceneId, Math.min(low.get(sceneId), low.get(next))); }
      else if (onStack.has(next)) low.set(sceneId, Math.min(low.get(sceneId), index.get(next)));
    }
    if (low.get(sceneId) !== index.get(sceneId)) return;
    const members = [];
    for (let member; member !== sceneId;) { member = stack.pop(); onStack.delete(member); members.push(member); }
    components.push(members);
  };
  connect(pack.initialSceneId);
  components.reverse();
  const componentOf = {}, active = [];
  components.forEach((members, position) => {
    const use = emptyUse();
    for (const sceneId of members) { componentOf[sceneId] = position; absorb(use, touches[sceneId]); }
    active.push({...use, flags: [...use.flags].sort()});
  });
  return {relevant, components, componentOf, active};
}
const flagsKey = (state, flags) => flags.map(flag => own(state.flags, flag) ? JSON.stringify(state.flags[flag]) : '').join(',');
const heldKey = (state, materials) => state.materialIds.filter(id => materials.has(id)).sort().join(',');
const capturesKey = (state, captures) => Object.keys(state.captures).filter(key => captures.has(key)).sort().join(',');
const kindsKey = (state, kinds) => [...new Set(state.receipts.map(receipt => receipt.kind))].filter(kind => kinds.has(kind)).sort().join(',');
// Identity of a state as later scenes can tell it apart.
const futureKey = (state, use) => [state.sceneId, flagsKey(state, use.flags), heldKey(state, use.materials),
  use.sources && state.materialIds.length ? 1 : 0, capturesKey(state, use.captures), kindsKey(state, use.kinds)].join('|');
// Identity of a state as the scenes of one component can tell it apart or change it.
const localKey = (state, use) => [state.sceneId, flagsKey(state, use.flags), heldKey(state, use.materials),
  use.sources && state.materialIds.some(id => !use.materials.has(id)) ? 1 : 0, capturesKey(state, use.captures), kindsKey(state, use.kinds)].join('|');
// A session that entered a component with other untouched values leaves it as the explored
// one did: the component's own values come from the explored exit, the rest stay its own.
function carry(member, exit, use) {
  const flags = {...member.flags}, captures = {};
  for (const flag of use.flags) if (own(exit.flags, flag)) flags[flag] = exit.flags[flag];
  for (const [key, value] of Object.entries(member.captures)) if (!use.captures.has(captureName(key))) captures[key] = value;
  for (const [key, value] of Object.entries(exit.captures)) if (use.captures.has(captureName(key))) captures[key] = value;
  return {...exit, flags, captures, opening: member.opening, notes: [], shares: [],
    materialIds: [...member.materialIds.filter(id => !use.materials.has(id)), ...exit.materialIds.filter(id => use.materials.has(id))],
    receipts: [...member.receipts.filter(receipt => !use.kinds.has(receipt.kind)), ...exit.receipts.filter(receipt => use.kinds.has(receipt.kind))],
    // New captures are numbered after every capture either session already holds.
    revision: Math.max(member.revision, exit.revision)};
}
// The smallest input an action's form accepts; a required source list needs one held material.
function fill(action, state) {
  const values = {};
  for (const field of action.fields || []) {
    if (field.type === 'materialRefs') {
      if (state.materialIds.length) values[field.id] = [state.materialIds[0]];
      else if (field.required) return null;
    } else if (field.type === 'select') values[field.id] = field.options[0].value;
    else values[field.id] = 'x';
  }
  return values;
}

function inspect(pack) {
  const targeted = new Set([pack.initialSceneId]), granted = new Set(pack.initialMaterials);
  const values = new Map(Object.entries(ENGINE_FLAGS).map(([flag, list]) => [flag, new Set(list)]));
  const remember = (flag, value) => { if (!values.has(flag)) values.set(flag, new Set()); values.get(flag).add(value); };
  for (const [flag, value] of Object.entries(pack.initialFlags)) remember(flag, value);
  const captures = new Set(), kinds = new Set(), gates = [];
  for (const [sceneId, scene] of Object.entries(pack.scenes)) {
    (scene.lines || []).forEach((line, index) => walkGates(line.requires, gate => gates.push({scene: sceneId, line: index, gate})));
    for (const action of scene.actions) {
      walkGates(action.requires, gate => gates.push({scene: sceneId, action: action.id, gate}));
      if (action.target !== undefined) targeted.add(action.target);
      const effects = action.effects || {};
      for (const [flag, value] of Object.entries(effects.set || {})) remember(flag, value);
      for (const id of effects.grant || []) granted.add(id);
      if (effects.capture) captures.add(effects.capture);
      if (effects.receipt) kinds.add(effects.receipt.kind);
    }
  }
  const undefinedFlags = new Set(), impossibleValues = [], receiptsWithoutCapture = [], receiptsWithoutEarlierKind = [];
  for (const {scene, action, line, gate} of gates) {
    if (!own(gate, 'flag')) continue;
    if (!values.has(gate.flag)) undefinedFlags.add(gate.flag);
    else if (!values.get(gate.flag).has(gate.equals)) impossibleValues.push({scene, ...(action === undefined ? {line} : {action}), flag: gate.flag});
  }
  for (const [sceneId, scene] of Object.entries(pack.scenes)) for (const action of scene.actions) {
    const receipt = action.effects?.receipt;
    if (receipt?.fromCapture && !captures.has(receipt.fromCapture)) receiptsWithoutCapture.push({scene: sceneId, action: action.id});
    if (receipt?.relatesTo && !kinds.has(receipt.relatesTo)) receiptsWithoutEarlierKind.push({scene: sceneId, action: action.id});
  }
  return {
    scenesNeverTargeted: Object.keys(pack.scenes).filter(id => !targeted.has(id)),
    materialsNeverGranted: Object.keys(pack.materials).filter(id => !granted.has(id)),
    undefinedFlags: [...undefinedFlags].sort(), impossibleValues, receiptsWithoutCapture, receiptsWithoutEarlierKind,
  };
}

export function checkCasePack(input, {openings = OPENINGS, maxStates = 1000000} = {}) {
  const pack = validateCasePack(input);
  const structure = inspect(pack), {relevant, components, componentOf, active} = analyse(pack);
  const scenesReached = new Set(), actionsRun = new Set(), materialsHeld = new Set(), linesShown = new Set(), refused = new Map();
  let exhaustive = true, explored = 0, covered = 0, operation = 0;
  // Sessions arriving at a component, by what later scenes can tell apart.
  const arrivals = components.map(() => new Map());
  const arrive = (state, from, steps) => {
    const position = componentOf[state.sceneId], key = futureKey(state, relevant[state.sceneId]);
    if (!arrivals[position].has(key)) {
      if (explored >= maxStates) { exhaustive = false; return null; }
      explored++;
      arrivals[position].set(key, {state, from, steps});
    }
    return key;
  };
  const route = (position, key) => {
    const arrival = arrivals[position].get(key);
    return arrival.from ? [...route(arrival.from.position, arrival.from.key), ...arrival.steps] : [];
  };
  for (const opening of openings) arrive(createCaseState(pack, validateOpening(opening)), null, []);

  const groupsOf = components.map(() => []);
  components.forEach((_, position) => {
    const use = active[position], groups = new Map();
    for (const [key, arrival] of arrivals[position]) {
      const group = localKey(arrival.state, use);
      if (!groups.has(group)) groups.set(group, {members: [], nodes: new Map(), exits: [], root: group});
      groups.get(group).members.push(key);
    }
    for (const group of groups.values()) {
      // Sessions in one group differ only in values this component never reads or changes,
      // so one of them is played through it and the others follow the same moves.
      const queue = [[group.root, arrivals[position].get(group.members[0]).state]];
      group.nodes.set(group.root, {scene: queue[0][1].sceneId, parent: null, via: null, next: new Set(), ending: false, stuck: false});
      for (let index = 0; index < queue.length; index++) {
        const [key, state] = queue[index], node = group.nodes.get(key), scene = pack.scenes[state.sceneId];
        scenesReached.add(state.sceneId);
        state.materialIds.forEach(id => materialsHeld.add(id));
        (scene.lines || []).forEach((line, line_index) => { if (gateAllows(line.requires, state)) linesShown.add(state.sceneId + '#' + line_index); });
        let moved = false;
        for (const action of scene.actions.filter(item => gateAllows(item.requires, state))) {
          const values = fill(action, state), label = state.sceneId + '/' + action.id;
          let next, code = values === null ? 'no_material_for_required_sources' : null;
          if (code === null) try {
            next = applyCaseAction(pack, state, {id: 'check-' + operation++, revision: state.revision, contentVersion: pack.contentVersion, actionId: action.id, values});
          } catch (error) {
            if (!(error instanceof CaseError)) throw error;
            code = error.code;
          }
          // A choice the player was offered and the engine then refused.
          if (code !== null) { refused.set(label + ':' + code, {scene: state.sceneId, action: action.id, code}); continue; }
          actionsRun.add(label); moved = true;
          if (componentOf[next.sceneId] !== position) { group.exits.push({node: key, action: action.id, state: next, position: componentOf[next.sceneId]}); continue; }
          const nextKey = localKey(next, use);
          if (!group.nodes.has(nextKey)) {
            if (explored >= maxStates) { exhaustive = false; continue; }
            explored++;
            group.nodes.set(nextKey, {scene: next.sceneId, parent: key, via: action.id, next: new Set(), ending: false, stuck: false});
            queue.push([nextKey, next]);
          }
          node.next.add(nextKey);
        }
        if (scene.actions.length === 0) node.ending = true;
        else if (!moved) node.stuck = true;
      }
      covered += group.members.length * group.nodes.size;
      group.steps = key => {
        const steps = [];
        for (let node = group.nodes.get(key); node.via !== null; node = group.nodes.get(node.parent)) steps.unshift(node.via);
        return steps;
      };
      group.path = key => [...route(position, group.members[0]), ...group.steps(key)];
      group.leads = group.members.map(member => group.exits.map(exit => {
        const from = arrivals[position].get(member).state;
        return arrive(carry(from, exit.state, use), {position, key: member}, [...group.steps(exit.node), exit.action]);
      }));
      for (const exit of group.exits) exit.state = null;
      groupsOf[position].push(group);
    }
    for (const arrival of arrivals[position].values()) arrival.state = null;
  });

  // A state is alive when an ending can still be reached from it. Later components are
  // settled first, so each exit already knows whether the session it produces is alive.
  const endings = new Map(), deadEnds = new Map(), trapped = new Map(), aliveArrival = components.map(() => new Map());
  const count = (map, group, key, members) => {
    const scene = group.nodes.get(key).scene;
    if (!map.has(scene)) map.set(scene, {scene, states: 0, path: group.path(key)});
    map.get(scene).states += members;
  };
  for (let position = components.length - 1; position >= 0; position--) for (const group of groupsOf[position]) {
    const before = new Map();
    for (const [key, node] of group.nodes) {
      if (node.ending) endings.set(node.scene, (endings.get(node.scene) || 0) + group.members.length);
      if (node.stuck) count(deadEnds, group, key, group.members.length);
      for (const next of node.next) { if (!before.has(next)) before.set(next, []); before.get(next).push(key); }
    }
    const outcomes = new Map();
    group.leads.forEach((leads, member) => {
      const signature = leads.map((key, exit) => key !== null && aliveArrival[group.exits[exit].position].get(key) ? 1 : 0).join('');
      if (!outcomes.has(signature)) outcomes.set(signature, []);
      outcomes.get(signature).push(member);
    });
    for (const [signature, members] of outcomes) {
      const alive = new Set([...group.nodes].filter(([, node]) => node.ending).map(([key]) => key));
      group.exits.forEach((exit, number) => { if (signature[number] === '1') alive.add(exit.node); });
      for (const pending = [...alive]; pending.length;) for (const previous of before.get(pending.pop()) || []) if (!alive.has(previous)) { alive.add(previous); pending.push(previous); }
      for (const member of members) aliveArrival[position].set(group.members[member], alive.has(group.root));
      if (exhaustive) for (const [key, node] of group.nodes) if (!alive.has(key) && !node.stuck) count(trapped, group, key, members.length);
    }
  }
  const actions = Object.entries(pack.scenes).flatMap(([scene, value]) => value.actions.map(action => ({scene, action: action.id})));
  const lines = Object.entries(pack.scenes).flatMap(([scene, value]) => (value.lines || []).map((_, line) => ({scene, line})));
  const report = {
    format: 'raven-case-path-check-v1', caseId: pack.caseId, contentVersion: pack.contentVersion,
    exhaustive, statesExplored: explored, statesCovered: covered, openingsChecked: openings.length,
    scenes: {total: Object.keys(pack.scenes).length, reached: scenesReached.size, neverReached: Object.keys(pack.scenes).filter(id => !scenesReached.has(id))},
    actions: {total: actions.length, run: actionsRun.size, neverRun: actions.filter(item => !actionsRun.has(item.scene + '/' + item.action))},
    materials: {total: Object.keys(pack.materials).length, held: materialsHeld.size, neverHeld: Object.keys(pack.materials).filter(id => !materialsHeld.has(id))},
    lines: {total: lines.length, shown: linesShown.size, neverShown: lines.filter(item => !linesShown.has(item.scene + '#' + item.line))},
    endings: [...endings].map(([scene, states]) => ({scene, states})),
    deadEnds: [...deadEnds.values()], trapped: [...trapped.values()], refusedActions: [...refused.values()], structure,
  };
  // "Never" findings are only conclusions when every state was explored.
  const never = exhaustive ? report.scenes.neverReached.length + report.actions.neverRun.length + report.materials.neverHeld.length + report.lines.neverShown.length : 0;
  report.problems = never + report.deadEnds.length + report.trapped.length + report.refusedActions.length + (report.endings.length ? 0 : 1) +
    structure.scenesNeverTargeted.length + structure.materialsNeverGranted.length + structure.undefinedFlags.length +
    structure.impossibleValues.length + structure.receiptsWithoutCapture.length + structure.receiptsWithoutEarlierKind.length;
  report.ok = exhaustive && report.problems === 0;
  return report;
}

// Counts only: what a terminal or a shared log may show.
export function summarizeCheck(report) {
  return {
    caseId: report.caseId, contentVersion: report.contentVersion, ok: report.ok, exhaustive: report.exhaustive,
    statesExplored: report.statesExplored, statesCovered: report.statesCovered, problems: report.problems,
    scenes: report.scenes.reached + '/' + report.scenes.total, actions: report.actions.run + '/' + report.actions.total,
    materials: report.materials.held + '/' + report.materials.total, lines: report.lines.shown + '/' + report.lines.total,
    endings: report.endings.length, deadEnds: report.deadEnds.length, trapped: report.trapped.length, refusedActions: report.refusedActions.length,
  };
}
