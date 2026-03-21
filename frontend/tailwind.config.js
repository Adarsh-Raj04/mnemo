export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eeedfe",
          100: "#cecbf6",
          200: "#afa9ec",
          400: "#7f77dd",
          600: "#534ab7",
          800: "#3c3489",
          900: "#26215c",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
