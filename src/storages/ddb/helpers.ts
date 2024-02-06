export const getConfirmationCode = () => {
  const num = Math.round(Math.random() * 10 ** 6);

  return num.toString().padStart(6, "0");
};
