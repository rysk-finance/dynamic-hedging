import dayjs from "dayjs";

import {
  One__One,
  One__Two,
  One__Three,
  Two__One,
  Two__Two,
  Two__Three,
  Two__Four,
  Two__Five,
  Two__Six,
  Two__Seven,
  Two__Eight,
  Three__One,
  Three__Two,
  Three__Three,
  Three__Four,
  Four__One,
  Four__Two,
  Five__One,
  Five__Two,
  Five__Three,
  Five__Four,
  Five__Five,
  Six__One,
  Six__Two,
  Six__Three,
  Six__Four,
  Six__Five,
  Six__Six,
  Six__Seven,
  Six__Eight,
  Six__Nine,
  Six__Ten,
  Seven__One,
  Seven__Two,
  Seven__Three,
  Seven__Four,
  Eight__One,
  Eight__Two,
  Eight__Three,
  Eight__Four,
  Eight__Five,
  Eight__Six,
  Eight__Seven,
  Eight__Eight,
  Eight__Nine,
} from "./blocks";

// ISO Format.
export const lastUpdated = dayjs("2023-07-03");

export const warning =
  "OUR SERVICES ARE NOT OFFERED TO PERSONS OR ENTITIES WHO RESIDE IN, ARE CITIZENS OF, ARE INCORPORATED IN, OR HAVE A REGISTERED OFFICE IN THE UNITED STATES OF AMERICA OR ANY RESTRICTED TERRITORY, AS DEFINED BELOW (ANY SUCH PERSON OR ENTITY FROM THE UNITED STATES OF AMERICA OR A RESTRICTED TERRITORY, A “RESTRICTED PERSON”). WE DO NOT MAKE EXCEPTIONS; THEREFORE, IF YOU ARE A RESTRICTED PERSON, THEN DO NOT ATTEMPT TO USE OR USE THE INTERFACE. USE OF A VIRTUAL PRIVATE NETWORK (E.G., A VPN) TO USE OUR SERVICES AS A RESTRICTED PERSON OR FROM THE UNITED STATES OF AMERICA OR A RESTRICTED TERRITORY IS PROHIBITED.";

export const contents = [
  {
    heading: "Site overview",
    key: "site-overview",
    sections: [
      {
        Component: One__One,
        key: "about-the-site",
        subHeading: "About the Site",
      },
      { Component: One__Two, key: "about-rysk", subHeading: "About Rysk" },
      {
        Component: One__Three,
        key: "relationship-to-rysk-smart-contract-system",
        subHeading: "Relationship to Rysk Smart Contract System",
      },
    ],
  },
  {
    heading: "Site operator discretion; certain risks of the site",
    key: "site-operator-discretion-certain-risks-of-the-site",
    sections: [
      {
        Component: Two__One,
        key: "content",
        subHeading: "Content",
      },
      {
        Component: Two__Two,
        key: "token-lists-and-token-identification",
        subHeading: "Token Lists and Token Identification",
      },
      {
        Component: Two__Three,
        key: "user-responsibility-for-accounts-security",
        subHeading: "User Responsibility for Accounts & Security",
      },
      {
        Component: Two__Four,
        key: "no-site-fees-third-party-fees-irreversible",
        subHeading: "No Site Fees; Third-Party Fees Irreversible",
      },
      {
        Component: Two__Five,
        key: "site-operator-has-no-business-plan",
        subHeading:
          "Site Operator Has No Business Plan and May Discontinue, Limit, Terminate or Refuse Support for the Site or any Smart Contracts, Tokens or Pools",
      },
      {
        Component: Two__Six,
        key: "site-operator-may-deny-or-limit-access-on-a-targeted-basis",
        subHeading:
          "Site Operator May Deny or Limit Access on a Targeted Basis",
      },
      {
        Component: Two__Seven,
        key: "site-operator-may-cooperate-with-investigations-and-disclose-information",
        subHeading:
          "Site Operator May Cooperate with Investigations and Disclose Information",
      },
      {
        Component: Two__Eight,
        key: "no-regulatory-supervision",
        subHeading: "No Regulatory Supervision",
      },
    ],
  },
  {
    heading: "Intellectual property matters",
    key: "intellectual-property-matters",
    sections: [
      {
        Component: Three__One,
        key: "license-to-use-site",
        subHeading: "License to Use Site",
      },
      {
        Component: Three__Two,
        key: "marks-logos-and-branding",
        subHeading: "Marks, Logos and Branding",
      },
      {
        Component: Three__Three,
        key: "privacy-policy",
        subHeading: "Privacy Policy",
      },
      {
        Component: Three__Four,
        key: "rysk-smart-contract-protocol",
        subHeading: "Rysk Smart Contract Protocol",
      },
    ],
  },
  {
    heading: "Permitted & prohibited uses",
    key: "permitted-prohibited-uses",
    sections: [
      {
        Component: Four__One,
        key: "permitted-uses",
        subHeading: "Permitted Uses",
      },
      {
        Component: Four__Two,
        key: "prohibited-uses",
        subHeading: "Prohibited Uses",
      },
    ],
  },
  {
    heading: "Representations and warranties of users",
    key: "representations-and-warranties-of-users",
    preSection:
      "Each User hereby represents and warrants to Site Operator that the following statements and information are accurate and complete at all relevant times. In the event that any such statement or information becomes untrue as to a User, User shall immediately cease accessing and using the Site.",
    sections: [
      {
        Component: Five__One,
        key: "adult-status-capacity-residence",
        subHeading: "Adult Status; Capacity; Residence; Etc.",
      },
      {
        Component: Five__Two,
        key: "power-and-authority",
        subHeading: "Power and Authority",
      },
      {
        Component: Five__Three,
        key: "no-conflict-compliance-with-law",
        subHeading: "No Conflict; Compliance with Law",
      },
      {
        Component: Five__Four,
        key: "absence-of-sanctions",
        subHeading: "Absence of Sanctions",
      },
      {
        Component: Five__Five,
        key: "non-reliance",
        subHeading: "Non-Reliance",
      },
    ],
  },
  {
    heading: "Risks, Disclaimers and Limitations of Liability",
    key: "risks-disclaimers-and-limitations-of-liability",
    preSection:
      "Each User hereby acknowledges and agrees and consents to, and assumes the risks of, the matters described in this Section 6.",
    sections: [
      {
        Component: Six__One,
        key: "no-consequential-incidental-or-punitive-damages",
        subHeading: "No Consequential, Incidental or Punitive Damages",
      },
      {
        Component: Six__Two,
        key: "disclaimer-of-representations",
        subHeading: "Disclaimer of Representations",
      },
      {
        Component: Six__Three,
        key: "no-responsibility-for-tokens-no-guarantee-of-uniqueness-or-ip",
        subHeading:
          "No Responsibility for Tokens; No Guarantee of Uniqueness or IP",
      },
      {
        Component: Six__Four,
        key: "no-professional-advice-or-liability",
        subHeading: "No Professional Advice or Liability",
      },
      {
        Component: Six__Five,
        key: "limited-survival-period-for-claims",
        subHeading: "Limited Survival Period for Claims",
      },
      {
        Component: Six__Six,
        key: "third-party-offerings-and-content",
        subHeading: "Third-Party Offerings and Content",
      },
      {
        Component: Six__Seven,
        key: "certain-uses-and-risks-of-blockchain-technology",
        subHeading: "Certain Uses and Risks of Blockchain Technology",
      },
      {
        Component: Six__Eight,
        key: "tax-issues",
        subHeading: "Tax Issues",
      },
      {
        Component: Six__Nine,
        key: "officers-directors",
        subHeading: "Officers, Directors, Etc.",
      },
      {
        Component: Six__Ten,
        key: "indemnification",
        subHeading: "Indemnification",
      },
    ],
  },
  {
    heading: "Governing law; Dispute Resolution",
    key: "governing-law-dispute-resolution",
    sections: [
      {
        Component: Seven__One,
        key: "settlement-negotiations",
        subHeading: "Settlement Negotiations",
      },
      {
        Component: Seven__Two,
        key: "agreement-to-binding-exclusive-arbitration",
        subHeading: "Agreement to Binding, Exclusive Arbitration",
      },
      {
        Component: Seven__Three,
        key: "court-jurisdiction",
        subHeading: "Court Jurisdiction",
      },
      {
        Component: Seven__Four,
        key: "class-action-waiver",
        subHeading: "Class Action Waiver",
      },
    ],
  },
  {
    heading: "Miscellaneous",
    key: "miscellaneous",
    sections: [
      {
        Component: Eight__One,
        key: "headings",
        subHeading: "Headings",
      },
      {
        Component: Eight__Two,
        key: "successors-and-assigns",
        subHeading: "Successors and Assigns",
      },
      {
        Component: Eight__Three,
        key: "severability",
        subHeading: "Severability",
      },
      {
        Component: Eight__Four,
        key: "force-majeure",
        subHeading: "Force Majeure",
      },
      {
        Component: Eight__Five,
        key: "amendments-and-modifications",
        subHeading: "Amendments and Modifications",
      },
      {
        Component: Eight__Six,
        key: "no-implied-waivers",
        subHeading: "No Implied Waivers",
      },
      {
        Component: Eight__Seven,
        key: "subcontracting",
        subHeading: "Subcontracting",
      },
      {
        Component: Eight__Eight,
        key: "entire-agreement",
        subHeading: "Entire Agreement",
      },
      {
        Component: Eight__Nine,
        key: "Rules-of-interpretation",
        subHeading: "Rules of Interpretation",
      },
    ],
  },
];
