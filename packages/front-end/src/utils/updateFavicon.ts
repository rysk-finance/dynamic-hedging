export const CONNECTED_FAVICON = "favicon.ico";
export const DISCONNECTED_FAVICON = "favicon_disconnected.ico";

export const updateFavicon = (filename: string) => {
  const linkElem = document.querySelector(
    "link[rel*='icon']"
  ) as HTMLLinkElement | null;
  if (linkElem) {
    linkElem.href = `${window.location.origin}/${filename}`;
  }
};
