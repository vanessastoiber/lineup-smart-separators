declare module "*.scss" {
  const content: string;
  export default content;
}
// allow image dependencies
declare module "*.png";
declare module "*.jpg";
declare module "*.gif";
declare module "*.webp";
declare module "*.svg";
declare module "*.xml" {
  const content: string;
  export default content;
}
declare module "*.txt" {
  const content: string;
  export default content;
}
//allow json dependencies
declare module "*.json";
