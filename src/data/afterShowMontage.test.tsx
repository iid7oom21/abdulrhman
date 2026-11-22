import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';
import { readMontageQuery, montageScenes, returnToEdit, localizeMontageScenes } from './afterShowMontage';
import { buildStoryboardJsonPayload } from '../utils/storyboardExport';

const selection = {shots: ['hand', 'exterior', 'hand'] as ('hand' | 'exterior')[], route: 'free'};

describe('montage handoff', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));
  it('accepts only a single ordered list of one to four approved local shots', () => {
    expect(readMontageQuery('lang=en')).toBeNull();
    for (const list of ['', 'hand,', 'unknown', 'lamp,lamp,lamp,lamp,lamp', '../file', '__proto__', 'constructor', 'lamp&afterShow=hand']) {
      expect(readMontageQuery('afterShow=' + list)).toBe('invalid');
    }
    expect(readMontageQuery('afterShow=hand,exterior,hand&from=free')).toEqual(selection);
    expect(readMontageQuery('afterShow=lamp&from=https://example.invalid')).toEqual({shots: ['lamp'], route: 'edit'});
    expect(returnToEdit(selection, 'ar')).toBe('../raven/after-show/?activity=free&lang=ar');
  });

  it('exports the accepted order/durations and distinguishes identical shots by position', () => {
    const scenes = montageScenes(selection, 'en');
    const json = buildStoryboardJsonPayload(scenes, {model: 'raven', aspectRatio: '16:9', lang: 'en'});
    expect(json.project.totalDurationSec).toBe(13);
    expect(new Set(scenes.map(s => s.id)).size).toBe(3);
    expect(json.scenes.map(s => s.durationSec)).toEqual([4, 5, 4]);
    expect(json.scenes[1].thumbnail).toBe('../raven/after-show/assets/exterior.webp');
    scenes[1].prompt = 'My own direction';
    const arabic = localizeMontageScenes(scenes, selection, 'en', 'ar');
    expect(arabic[0].prompt).toBe(montageScenes(selection, 'ar')[0].prompt);
    expect(arabic[1].prompt).toBe('My own direction');
  });

  it('opens a preview, then an editable board with the chosen number of scenes after consent', () => {
    window.history.replaceState(null, '', '/studio/?lang=en&afterShow=lamp,hand&from=duo');
    render(<App />);
    expect(screen.getByRole('list', {name: 'Shot order'}).children).toHaveLength(2);
    expect(screen.queryByRole('button', {name: 'Export JSON'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Use shots in storyboard'}));
    expect(screen.getByRole('button', {name: 'Export PDF'})).toBeEnabled();
    const direction = screen.getByRole('textbox', {name: 'Shot direction 1'});
    fireEvent.change(direction, {target: {value: 'Push in to the lamp'}});
    expect(direction).toHaveValue('Push in to the lamp');
    expect(screen.getByRole('link', {name: 'Return to my round'})).toHaveAttribute('href', '../raven/after-show/?activity=duo&lang=en');
  });
});
