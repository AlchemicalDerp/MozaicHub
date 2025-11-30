const { marked } = require('marked');
const createDomPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDomPurify(window);

marked.setOptions({ breaks: true, gfm: true });

function extractMentions(text) {
  const mentions = new Set();
  const regex = /@([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    mentions.add(match[1]);
  }
  return Array.from(mentions);
}

function renderMarkdown(text, linkForUser = (username) => `#/users/${username}`) {
  const mentionAdjusted = (text || '').replace(/@([a-zA-Z0-9_]+)/g, (full, name) => `[@${name}](${linkForUser(name)})`);
  const raw = marked.parse(mentionAdjusted || '');
  return DOMPurify.sanitize(raw);
}

module.exports = { renderMarkdown, extractMentions };
