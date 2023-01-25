import type { AvatarComponent } from "@rainbow-me/rainbowkit";

import { hexToCSSFilter } from "hex-to-css-filter";

const CustomAvatar: AvatarComponent = ({ address, ensImage, size }) => {
  const borderRadius = size / 2;
  const iconSize = size * 0.65;

  const addressToColor = `#${address.slice(2, 8)}`;
  const colorToCSS = hexToCSSFilter(addressToColor).filter.slice(0, -1);

  return ensImage ? (
    <img
      alt="Your ENS avatar."
      src={ensImage}
      width={size}
      height={size}
      style={{ borderRadius }}
    />
  ) : (
    <div
      className="flex justify-center items-center bg-bone"
      style={{
        borderRadius,
        height: size,
        width: size,
      }}
    >
      <img
        src="./kite-black.gif"
        width={iconSize}
        height={iconSize}
        alt="Rysk rotating logo."
        style={{
          filter: colorToCSS,
        }}
      />
    </div>
  );
};

export default CustomAvatar;
