export const getConfirmationCode = () => {
  const num = Math.round(Math.random() * 10 ** 6);

  return num.toString().padStart(6, "0");
};

export const getExpireAtValue = (numberOfDays: number = 30) => {
  if (numberOfDays < 0) {
    throw new Error("Invalid number of days:" + numberOfDays);
  }
  const ttl = new Date();
  ttl.setDate(ttl.getDate() + numberOfDays);

  return Math.round(ttl.getTime() / 1000);
};
