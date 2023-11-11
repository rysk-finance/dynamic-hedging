import { Header } from "./components/Header";
import { Active } from "./components/Active";
import { Footnotes } from "./components/Footnotes";
import { Info } from "./components/Info";
import { Table } from "./components/Table";
import { useAirdropData } from "./hooks/useAirdropData";

export const RewardsContent = () => {
  const [recipients, totalRecipients, totalArb, totalValue] = useAirdropData();

  

  return (
    <main className="col-start-2 col-end-16 mt-16 text-justify [&_section]:mb-16 last:[&_section]:mb-0">
      <Header />
      <Active />
      <Info recipients={totalRecipients} tokens={totalArb} value={totalValue} />
      <Table recipients={recipients} />
      <Footnotes />
    </main>
  );
};
