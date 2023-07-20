import { Checkboxes } from "./components/Checkboxes";
import { Preferences } from "./components/Preferences";

export const Filters = () => {
  return (
    <div className="flex md:flex-col xl:flex-row xl:bg-[url('./assets/wave-lines.png')] bg-[top_left_-20%] bg-no-repeat bg-contain overflow-hidden">
      <Checkboxes />

      <Preferences />
    </div>
  );
};
