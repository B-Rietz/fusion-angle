import { html, type SafeHtml } from '../safe-html.ts';

// Every displayed id wears one look: the thing it names, then
// the whole id in a `.displayed-id` code element. The markup
// always holds the full id, for copy, search, and screen
// readers; CSS alone clips it with an ellipsis.
export function idLabel(thing: string, id: string): SafeHtml {
    return html`${thing} <code class="displayed-id">${id}</code>`;
}
