export const revalidate = 5;
export default function IsrPage() {
  return <p data-stamp={Date.now()}>isr-stamp:{Date.now()}:end</p>;
}
