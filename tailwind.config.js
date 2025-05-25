/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    "./renderer/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./renderer/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./renderer/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    {
      pattern:
        /(bg|border)-(unscored|correct|partial|pending|incorrect|noanswer)/,
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
        unscored: "#D3D3D3",
        correct: "#3CB371",
        partial: "#FFBF00",
        pending: "#00BFFF",
        incorrect: "#FF6347",
        noanswer: "#A232A2",
        selectedAnswer: "#BFDEFF",
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
        "pop-in": {
          "0%": {
            transform: "translateY(10px)",
            opacity: "0",
          },
          "70%": {
            transform: "translateY(-10px)",
            opacity: "1",
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
        "pop-in": "pop-in .3s ease",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
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
