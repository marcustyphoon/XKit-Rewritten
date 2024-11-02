import { dom } from './dom.js';

export const addSuggestionList = (tagsInput) => {
  const tagSuggestions = dom('div', { class: 'xkit-suggestion-datalist' });

  const renderTagSuggestions = () => {
    const currentTags = tagsInput.value
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag !== '');

    const tagsToSuggest = (tagSuggestions.dataset.suggestableTags?.split(',') ?? [])
      .filter(tag => !currentTags.includes(tag.toLowerCase()))
      .filter((tag, index, array) => array.indexOf(tag) === index);

    tagSuggestions.replaceChildren(
      dom('div', null, null, tagsToSuggest.map(value => dom('button', { 'data-value': value }, null, [value])))
    );
  };

  const updateTagSuggestions = () => {
    if (tagsInput.value.trim().endsWith(',') || tagsInput.value.trim() === '') {
      renderTagSuggestions();
      tagsInput.after(tagSuggestions);
    } else {
      tagSuggestions.remove();
    }
  };

  tagSuggestions.addEventListener('click', event => {
    if (event.target.dataset.value) {
      tagsInput.value += `${event.target.dataset.value}, `;
      tagsInput.focus();
      renderTagSuggestions();
    }
  });

  tagsInput.addEventListener('input', updateTagSuggestions);
  updateTagSuggestions();

  return tagSuggestions;
};
