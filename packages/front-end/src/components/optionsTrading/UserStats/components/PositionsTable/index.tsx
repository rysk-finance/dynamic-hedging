import { Body } from "./components/Body";
import { Head } from "./components/Head";

export const Table = () => (
  <table className="block [&>*]:block text-lg overflow-x-auto overflow-y-hidden">
    <Head />
    <Body />
  </table>
);
