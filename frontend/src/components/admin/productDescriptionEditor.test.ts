import { describe, expect, it } from 'vitest';
import { descriptionHtmlToText, descriptionTextToHtml } from './productDescriptionEditor';

describe('product description editor conversion', () => {
  it('converts saved HTML into readable editable text', () => {
    expect(
      descriptionHtmlToText(
        '<p>Hand-poured <strong>soy wax</strong>.</p><ul><li>Clean burn</li><li>Gift-ready</li></ul>'
      )
    ).toBe('Hand-poured **soy wax**.\n\n• Clean burn\n• Gift-ready');
  });

  it('converts edited text back into safe, formatted HTML', () => {
    expect(
      descriptionTextToHtml('### Details\nA **bold** candle.\n\n• First\n• <second>')
    ).toBe(
      '<h3>Details</h3>\n<p>A <strong>bold</strong> candle.</p>\n<ul><li>First</li><li>&lt;second&gt;</li></ul>'
    );
  });
});
