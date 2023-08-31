import dayjs from "dayjs";

import {
  AccessingAndEditingYourInformation,
  AgeCompliance,
  Amendments,
  Analytics,
  Contact,
  Cookies,
  DataCollected,
  GovernmentalEntities,
  InternationalTransfer,
  MergerAndAcquisition,
  OptOut,
  Processing,
  Rights,
  SecurityMeasures,
  ThirdParty,
  UseOfYourData,
} from "./blocks";

// ISO Format.
export const lastUpdated = dayjs("2023-07-03");

export const intro = [
  "The following Privacy Policy (hereinafter “Privacy Policy”) explains how Rysk collects and uses any information You submit when using the Site, as defined within the Rysk Terms of Service (hereinafter “User Terms”), available at the following link: https://app.rysk.finance. This Privacy Policy should be read in conjunction with the User Terms, in which it is integrated.",
  "All capitalized proper nouns not defined in this Privacy Policy meet the same definitions and have the same meanings set out in the User Terms.",
  "Please, review the Privacy Policy periodically, as it may be subject to changes.",
  "In case you do not agree with or accept our Privacy Policy in its entirety, you must not access or use the Interface.",
  "If you use the Interface following a change to the terms of this Privacy Policy, you agree to accept the revised terms.",
  "Please, do not submit any information to us if you reside in a Restricted Territory or if you or your organization is a Restricted Person or US Person.",
];

export const contents = [
  {
    Component: DataCollected,
    key: "data-collected",
    label: "Data collected",
  },
  {
    Component: Processing,
    key: "processing",
    label:
      "Who is the person determining the purposes and means of the processing?",
  },
  {
    Component: UseOfYourData,
    key: "use-of-your-data",
    label: "Use of your data",
  },
  { Component: Analytics, key: "analytics", label: "Analytics" },
  {
    Component: GovernmentalEntities,
    key: "governmental-entities",
    label: "Governmental entities",
  },
  { Component: Cookies, key: "cookies", label: "Cookies" },
  {
    Component: AccessingAndEditingYourInformation,
    key: "accessing-and-editing-your-information",
    label: "Accessing and editing your information",
  },
  {
    Component: OptOut,
    key: "opt-out",
    label:
      "Opt out of commercial, non-commercial communications and do not track",
  },
  {
    Component: ThirdParty,
    key: "third-party-websites-and-links",
    label: "Third-Party websites and links",
  },
  {
    Component: Rights,
    key: "rights-of-the-data-subject",
    label: "Rights of the data subject",
  },
  {
    Component: SecurityMeasures,
    key: "security-measures",
    label: "Security measures",
  },
  { Component: AgeCompliance, key: "age-compliance", label: "Age compliance" },
  {
    Component: InternationalTransfer,
    key: "international-transfer",
    label: "International transfer",
  },
  {
    Component: MergerAndAcquisition,
    key: "merger-and-acquisition",
    label: "Merger and acquisition",
  },
  { Component: Amendments, key: "amendments", label: "Amendments" },
  { Component: Contact, key: "contact", label: "Contact" },
];
