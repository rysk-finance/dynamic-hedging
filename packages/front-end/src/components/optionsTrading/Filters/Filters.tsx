import { Checkboxes } from "./components/Checkboxes";
import { StrikeRange } from "./components/StrikeRange";
import { Reset } from "./components/Reset";
import { Settings } from "./components/Settings";

export const Filters = () => {
  return (
    <div className="flex md:flex-col xl:flex-row xl:bg-[url('./assets/wave-lines.png')] bg-[top_left_-20%] bg-no-repeat bg-contain overflow-hidden">
      <Checkboxes />

      <StrikeRange />

      <Reset />

      <Settings />
    </div>
  );
};
