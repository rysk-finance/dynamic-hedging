import { Ether, USDC } from "src/Icons";

export const AssetLogos = () => (
  <span className="relative flex min-w-[8rem] py-4 border-r-2 border-black">
    <div className="absolute left-4 z-10 flex items-center justify-center w-16 h-16 bg-[#ECEFF0]/90 rounded-full">
      <Ether aria-label="Ethereum logo" className="h-12" />
    </div>
    <USDC aria-label="USDC logo" className="absolute right-4 z-0 h-16" />
  </span>
);
