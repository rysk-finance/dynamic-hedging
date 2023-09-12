import dayjs from "dayjs";

import { Discord, Github, Twitter } from "src/Icons";
import { AppPaths } from "src/config/appPaths";
import { DISCORD_LINK, GITHUB_LINK, TWITTER_LINK } from "src/config/links";
import {
  getContractAddress,
  shorthandContractAddress,
} from "src/utils/helpers";

const liquidityPool = getContractAddress("liquidityPool");
const optionExchange = getContractAddress("optionExchange");
const USDC = getContractAddress("USDC");
const WETH = getContractAddress("WETH");

export const footerData = [
  {
    colStart: "col-start-6",
    heading: "Addresses",
    links: [
      {
        label: `Liquidity Pool (${shorthandContractAddress(liquidityPool)})`,
        href: `${process.env.REACT_APP_SCAN_URL}/address/${liquidityPool}`,
      },
      {
        label: `Options Exchange (${shorthandContractAddress(optionExchange)})`,
        href: `${process.env.REACT_APP_SCAN_URL}/address/${optionExchange}`,
      },
      {
        label: `USDC (Native) (${shorthandContractAddress(USDC)})`,
        href: `${process.env.REACT_APP_SCAN_URL}/address/${USDC}`,
      },
      {
        label: `WETH (${shorthandContractAddress(WETH)})`,
        href: `${process.env.REACT_APP_SCAN_URL}/address/${WETH}`,
      },
    ],
  },
  {
    colStart: "col-start-8",
    heading: "Resources",
    links: [
      {
        label: "Audits",
        href: "https://docs.rysk.finance/security/security-reviews",
      },
      {
        label: "Bug bounty",
        href: "https://immunefi.com/bounty/rysk/",
      },
      {
        label: "Contracts",
        href: "https://docs.rysk.finance/developers/contract-by-contract-overview",
      },
      {
        label: "Getting started",
        href: "https://docs.rysk.finance/getting-started/what-is-rysk",
      },
      {
        label: "How to",
        href: "https://docs.rysk.finance/guides/how-to...",
      },
      {
        label: "Subgraph",
        href: process.env.REACT_APP_SUBGRAPH_URL || "",
      },
    ],
  },
  {
    colStart: "col-start-10",
    heading: "Rysky business",
    links: [
      {
        label: "Rysk blog",
        href: "https://blog.rysk.finance",
      },
      {
        label: "Press kit",
        href: "https://www.rysk.finance/press.zip",
      },
      {
        label: "Privacy policy",
        href: AppPaths.PRIVACY_POLICY,
      },
      {
        label: "Terms of service",
        href: AppPaths.TERMS_OF_SERVICE,
      },
    ],
  },
];

export const socials = [
  {
    Icon: Discord,
    href: DISCORD_LINK,
  },
  {
    Icon: Github,
    href: GITHUB_LINK,
  },
  {
    Icon: Twitter,
    href: TWITTER_LINK,
  },
];

export const missionStatement =
  "Rysk is a DeFi options protocol, generating uncorrelated returns for its liquidity providers whilst enabling anyone to trade options with a wide range of strike prices and expiry dates. The main focus of Rysk is to offer tight bid and ask spreads for traders, deep concentrated liquidity and improved capital efficiency.";

export const copyright = `© ${dayjs().year()} Rysk - All rights reserved`;
