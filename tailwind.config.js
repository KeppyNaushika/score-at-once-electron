/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    "./renderer/pages/**/*.{js,ts,jsx,tsx}",
    "./renderer/components/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    {
      pattern: /bg-(unscored|correct|partial|pending|incorrect)/,
    },
  ],
  theme: {
    zIndex: {
      0: 0,
      10: 10,
      20: 20,
      30: 30,
      40: 40,
      50: 50,
      25: 25,
      50: 50,
      75: 75,
      100: 100,
      1000: 1000,
      auto: "auto",
    },
    extend: {
      colors: {
        primary: "#A0A0A0",
        unscored: "#BFB29E",
        correct: "#00d199",
        partial: "#FFEA00",
        pending: "#0079FF",
        incorrect: "#FF0060",
      },
      keyframes: {
        "expand-width": {
          "0%": {
            transform: "scaleX(0.5)",
            opacity: "1",
          },
          to: {
            transform: "scaleX(1)",
            opacity: "1",
          },
        },
        "float-in": {
          "0%": {
            transform: "translateY(-10px)",
            opacity: "0",
          },
          to: {
            transform: "translateY(0px)",
            opacity: "1",
          },
        },
      },
      animation: {
        "expand-width": "expand-width .15s ease",
        "float-in": "float-in .2s ease",
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      const newUtilities = {
        ".dragging-rectangle": {
          position: "absolute",
          backgroundColor: "#007bff",
          opacity: "0.5",
        },
        // 他に必要なスタイルがあればここに追加
      }
      addUtilities(newUtilities)
    },
  ],
}
