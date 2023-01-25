import type { Theme } from "@rainbow-me/rainbowkit";
import { lightTheme } from "@rainbow-me/rainbowkit";

const init = lightTheme();

const colors = {
  accentColor: "#000000",
  accentColorForeground: "#ffffff",
  closeButton: "#000000",
  closeButtonBackground: "rgba(0, 0, 0, 0.06)",
  connectButtonBackground: "#000000",
  connectButtonBackgroundError: "#E40F00",
  connectButtonText: "#ffffff",
  connectButtonTextError: "#ffffff",
  connectionIndicator: "#6ABD00",
  downloadBottomCardBackground:
    "linear-gradient(126deg, rgba(255, 255, 255, 0) 9.49%, rgba(171, 171, 171, 0.04) 71.04%), #EDE9DD",
  downloadTopCardBackground:
    "linear-gradient(126deg, rgba(171, 171, 171, 0.2) 9.49%, rgba(255, 255, 255, 0) 71.04%), #EDE9DD",
  error: "#E40F00",
  menuItemBackground: "rgba(0, 0, 0, 0.06)",
  modalBackdrop: "rgba(0, 0, 0, 0.3)",
  modalBackground: "#EDE9DD",
  modalBorder: "transparent",
  modalText: "#000000",
  modalTextDim: "rgba(0, 0, 0 ,0.3)",
  modalTextSecondary: "#000000",
  profileAction: "#ffffff",
  profileActionHover: "rgba(255, 255, 255, 0.88)",
  profileForeground: "rgba(0, 0, 0, 0.06)",
  selectedOptionBorder: "rgba(0, 0, 0, 0.1)",
  standby: "#EDD900",
};

const fonts = {
  body: `DM Sans, sans-serif`,
};

const radii = {
  actionButton: "0.5rem",
  connectButton: "0.5rem",
  menuButton: "0.5rem",
  modal: "0.5rem",
  modalMobile: "0.5rem",
};

const CustomTheme: Theme = {
  ...init,
  colors: { ...init.colors, ...colors },
  fonts: { ...init.fonts, ...fonts },
  radii,
};

export default CustomTheme;
