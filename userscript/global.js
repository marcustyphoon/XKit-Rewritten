// eslint-disable-next-line no-unused-vars
/* global GM_getValues GM_setValues GM_deleteValue GM_deleteValues */

// eslint-disable-next-line no-global-assign
browser = {
  storage: {
    local: {
      get: async (keyOrKeys) => GM_getValues(typeof keyOrKeys === 'string' ? [keyOrKeys] : keyOrKeys),
      set: async (values) => GM_setValues(values)
    }
  },
  runtime: {}
};
