export const debounce = (func, ms) => {
  let timeoutID;
  const result = (...args) => {
    clearTimeout(timeoutID);
    timeoutID = setTimeout(() => func(...args), ms);
  };
  result.cancel = () => clearTimeout(timeoutID);
  return result;
};
