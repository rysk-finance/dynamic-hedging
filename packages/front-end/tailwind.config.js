module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  screens: {
    sm: "480px",
    md: "768px",
    lg: "976px",
    xl: "1440px",
  },
  theme: {
    extend: {
      colors: {
        black: "#000000",
        white: "#ffffff",
        bone: "#e6e4d8",
        cyan: "#05f7e7",
      },
      keyframes: {
        "border-round": {
          "0%": { borderRadius: "0px" },
          "100%": { borderRadius: "9999px" },
        },
      },
      animation: {
        "border-round": "border-round 5s ease-in-out",
      },
      fontFamily: {
        "dm-mono": ["DM Mono"],
      },
      gridColumnStart: {
        13: "13",
        14: "14",
        15: "15",
        16: "16",
        17: "17",
      },
      gridColumnEnd: {
        13: "13",
        14: "14",
        15: "15",
        16: "16",
        17: "17",
      },
    },
  },
  variants: {
    extend: {
      animation: ["hover", "group-hover"],
    },
  },
  plugins: [],
};
