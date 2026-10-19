export const arabic = (value) => new Intl.NumberFormat('ar-SA', { useGrouping: false }).format(value);

export function node(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') element.className = value;
    else if (key === 'text') element.textContent = value;
    else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) element.setAttribute(key, '');
    else element.setAttribute(key, String(value));
  }
  for (const child of [children].flat()) {
    if (child !== null && child !== undefined) element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}
