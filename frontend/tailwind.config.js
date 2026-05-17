export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream:   { DEFAULT: "#FAF6EE", dark: "#F2EBD9" },
        sawtha:  { DEFAULT: "#C8571B", dark: "#A8430F", light: "#F5E8DF" },
        olive:   { DEFAULT: "#3A5A2A", dark: "#2D4520", light: "#EBF0E7", mid: "#4A7A35" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
