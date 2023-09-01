import { HashLink } from "react-router-hash-link";

import { Heading1, Heading2, Heading3 } from "../shared/Heading";
import { LastUpdated } from "../shared/LastUpdated";
import { Main } from "../shared/Main";
import { MainSection } from "../shared/MainSection";
import { OrderedList } from "../shared/OrderedList";
import { Intro } from "./blocks/intro";
import { contents, lastUpdated, warning } from "./info";

export const TermsOfServiceContent = () => {
  return (
    <Main>
      <Heading1>{`Terms of Service`}</Heading1>

      <LastUpdated lastUpdated={lastUpdated} />

      <strong className="block mt-16 mb-8 text-justify">{warning}</strong>

      <Intro />

      <section className="font-dm-mono mt-16 mb-8">
        <Heading2 className="!mb-2.5">{`Table of contents`}</Heading2>
        <OrderedList>
          {contents.map(({ heading, key, sections }) => (
            <li key={key}>
              <HashLink className="block py-2.5 w-fit" to={`#${key}`}>
                {heading}
              </HashLink>
              <OrderedList>
                {sections.map(({ key: subKey, subHeading }) => (
                  <li key={subKey}>
                    <HashLink className="block py-2.5 w-fit" to={`#${subKey}`}>
                      {subHeading}
                    </HashLink>
                  </li>
                ))}
              </OrderedList>
            </li>
          ))}
        </OrderedList>
      </section>

      {contents.map(({ heading, key, preSection, sections }, index) => (
        <MainSection id={key} key={key}>
          <Heading3>{`${index + 1}. ${heading}`}</Heading3>
          {preSection && <p>{preSection}</p>}

          {sections.map(({ Component, key: subKey, subHeading }, subIndex) => (
            <div className="pt-4" id={subKey} key={subKey}>
              <h4 className="!mt-0 font-dm-mono font-medium">{`${index + 1}.${
                subIndex + 1
              } ${subHeading}`}</h4>
              <Component />
            </div>
          ))}
        </MainSection>
      ))}
    </Main>
  );
};
