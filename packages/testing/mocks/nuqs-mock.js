// Mock for nuqs module to avoid adapter requirement
export const useQueryState = (key, options) => [
  options?.defaultValue || null,
  () => {},
];

export default {
  useQueryState,
};