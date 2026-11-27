/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: "#171717",
        cream: "#F7F3EA",
        "food-orange": "#F47738",
        "muted-olive": "#858B65",
        "warm-grey": "#A6A29B",
      },
      fontFamily: {
        display: ['"Syne"', '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
