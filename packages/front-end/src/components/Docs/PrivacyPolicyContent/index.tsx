import { HashLink } from "react-router-hash-link";

import { Heading1, Heading2, Heading3 } from "../shared/Heading";
import { LastUpdated } from "../shared/LastUpdated";
import { Main } from "../shared/Main";
import { MainSection } from "../shared/MainSection";
import { OrderedList } from "../shared/OrderedList";
import { Paragraph } from "../shared/Paragraph";
import { contents, intro, lastUpdated } from "./info";

export const PrivacyPolicyContent = () => {
  return (
    <Main>
      <Heading1>{`Privacy Policy`}</Heading1>

      <LastUpdated lastUpdated={lastUpdated} />

      <section className="my-16">
        {intro.map((para) => (
          <Paragraph key={para}>{para}</Paragraph>
        ))}
      </section>

      <section className="font-dm-mono my-8">
        <Heading2 className="!mb-2.5">{`Table of contents`}</Heading2>
        <OrderedList>
          {contents.map(({ key, label }) => (
            <li key={key}>
              <HashLink className="block py-2.5 w-fit" to={`#${key}`}>
                {label}
              </HashLink>
            </li>
          ))}
        </OrderedList>
      </section>

      {contents.map(({ Component, key, label }) => (
        <MainSection id={key} key={key}>
          <Heading3>{label}</Heading3>
          <Component />
        </MainSection>
      ))}
    </Main>
  );
};
