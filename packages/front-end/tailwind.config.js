module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
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
    },
  },
  variants: {
    extend: {
      animation: ["hover", "group-hover"],
    },
  },
  plugins: [],
};
