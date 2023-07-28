export const Stats = ({ cumulativeYield = 0 }: { cumulativeYield: number }) => (
  <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full justify-around">
    <h4 className="mb-2 text-xl">{`Historical Returns: ${cumulativeYield}%`}</h4>
    <h4 className="mb-2 text-xl">{`Annualized Returns: Soon™️`}</h4>
  </div>
);
