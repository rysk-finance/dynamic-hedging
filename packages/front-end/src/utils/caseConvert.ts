const capitalise = (string: string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const kebabToCapital = (string?: string) => {
  if (string) {
    return string
      .split("-")
      .map((chunk) => capitalise(chunk))
      .join(" ");
  }

  return "";
};

export { capitalise, kebabToCapital };
