/**
 * CSS/SCSSファイルの型宣言
 */
declare module "*.css" {
  const content: { [className: string]: string }
  export default content
}

declare module "*.scss" {
  const content: { [className: string]: string }
  export default content
}

declare module "react-datepicker/dist/react-datepicker.css"
