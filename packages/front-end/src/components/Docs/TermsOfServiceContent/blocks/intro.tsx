import { MainSection } from "../../shared/MainSection";

export const Intro = () => (
  <MainSection>
    <p>
      {`These terms and conditions (these "Terms") constitute a binding legal agreement between each individual, entity, group or association who views, interacts, links to or otherwise uses or derives any benefit from the Site (as defined below) ("Users") and Rysk (the owner/operator of the Site) and each of its successors and assigns (the "Site Operator").`}
    </p>

    <p>
      {`Please contact us at `}
      <a href="mailto:legal@rysk.finance">{`legal@rysk.finance`}</a>
      {` for any questions or issues.`}
    </p>

    <p>{`Eligibility`}</p>

    <p>{`In order to use the Site, you must satisfy the following eligibility requirements:`}</p>

    <ul>
      <li>{`You are of legal age in the jurisdiction in which you reside and you have the legal capacity to enter into the Terms and be bound by them;`}</li>
      <li>{`If you accept the Terms on behalf of a legal entity, you must have the legal authority to accept the Terms on that entity’s behalf, in which case “you” (except as used in this paragraph) will mean that entity;`}</li>
      <li>{`You are not a resident, national or agent of Antigua and Barbuda, Algeria, Bangladesh, Bolivia, Belarus, Burundi, Myanmar (Burma), Cote D'Ivoire (Ivory Coast), Crimea and Sevastopol, Cuba, Democratic Republic of Congo, Ecuador, Iran, Iraq, Libya, Mali, Morocco, Magnitsky, Liberia, Nepal, North Korea, Somalia, Sudan, Syria, Venezuela, Zimbabwe or any other country to which the United States, the United Kingdom or the European Union embargoes goods or imposes similar sanctions (collectively, “Restricted Territories”); (ii) you are a member of any sanctions list or equivalent maintained by the United States government, the United Kingdom government, by the European Union or the United Nations (collectively, “Sanctions Lists Persons”); or (iii) you intend to transact with any Restricted Territories or Sanctions List Persons;`}</li>
      <li>{`You are not a Restricted Person;`}</li>
      <li>{`You are not a resident of, reside in, a citizen of, incorporated in, or have a registered office in Taiwan (Republic of China), or the United States of America, or the United Kingdom; and`}</li>
      <li>{`Your use of the Interface is not prohibited by and does not otherwise violate, assist you in the violation of any applicable laws or regulations, or contribute to or facilitate any illegal activity.`}</li>
    </ul>
  </MainSection>
);
