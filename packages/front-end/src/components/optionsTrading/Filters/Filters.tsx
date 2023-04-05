import { Checkboxes } from "./components/Checkboxes";
import { StrikeRange } from "./components/StrikeRange";
import { Reset } from "./components/Reset";

export const Filters = () => {
  return (
    <div className="flex md:flex-col xl:flex-row border-t-2 border-black xl:bg-[url('./assets/wave-lines.png')] bg-[top_left_-20%] bg-no-repeat bg-contain">
      <Checkboxes />

      <StrikeRange />

      <Reset />
    </div>
  );
};
