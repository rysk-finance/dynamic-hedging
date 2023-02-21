module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      animation: {
        "border-round": "border-round 5s ease-in-out",
      },
      colors: {
        black: "#000000",
        white: "#ffffff",
        bone: "#EDE9DD",
        "bone-dark": "#D1CDBF",
        "bone-light": "#F5F3EC",
        cyan: "#05f7e7",
        "cyan-dark": "#02c5e6",
        red: {
          100: "#FFF0EF",
          300: "#FF9991",
          500: "#FF3425",
          600: "#E40F00",
          900: "#A60B00",
        },
        yellow: {
          100: "#FFFAC8",
          300: "#F9DA75",
          500: "#FFEA01",
          600: "#EDD900",
          900: "#C8B800",
        },
        green: {
          100: "#E9FECC",
          300: "#B5FD55",
          500: "#78D202",
          600: "#6ABD00",
          900: "#417301",
        },
        gray: {
          100: "#F5F5F5",
          300: "#EBEBEB",
          500: "#BBBBBB",
          600: "#989898",
        },
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
      fontFamily: {
        "dm-mono": ["DM Mono"],
        "dm-sans": ["DM Sans"],
        parabole: ["Parabole"],
      },
      fontSize: {
        "2xs": ["10px", "12px"],
        lg: ["18px", "20px"],
        xl: ["24px", "26px"],
        "2xl": ["36px", "40px"],
        "3xl": ["48px", "52px"],
        "4xl": ["64px", "64px"],
      },
      keyframes: {
        "border-round": {
          "0%": { borderRadius: "0px" },
          "100%": { borderRadius: "9999px" },
        },
      },
      screens: {
        "2xl": "1440px",
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
