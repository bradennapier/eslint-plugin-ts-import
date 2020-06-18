import ImportPatternsRule from './rules/patterns';

const plugin = {
  rules: {
    patterns: new ImportPatternsRule(),
  },
};

export default plugin;
