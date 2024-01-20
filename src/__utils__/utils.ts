export const MockOf = <T>(...methods: (keyof T)[]) => {
  const obj = {} as T;
  for (const method of methods) {
    obj[method] = vi.fn() as T[keyof T];
  }

  return obj;
};
