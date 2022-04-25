import { ResponsiveLine, Serie } from "@nivo/line";
import React from "react";

type ReturnLineChartProps = {
  data: Serie[];
};

const Tooltip: ResponsiveLine["props"]["tooltip"] = ({ point: { y } }) => {
  return (
    <div className="border-2 border-black px-2 py-1 bg-white">
      <p>${y}</p>
    </div>
  );
};

export const ReturnLineChart: React.FC<ReturnLineChartProps> = ({ data }) => {
  const yVals = data[0].data
    .map((point) => point.y)
    .filter((point): point is number => typeof point === "number");

  const yMax = Math.max(...yVals);
  const yMin = Math.min(...yVals);
  const margin = yMax / 10;
  return (
    <ResponsiveLine
      data={data}
      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      xScale={{ type: "point" }}
      yScale={{
        type: "linear",
        min: yMin - margin,
        max: yMax + margin,
        stacked: true,
        reverse: false,
      }}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickValues: [],
      }}
      axisLeft={{
        tickValues: [0],
      }}
      pointSize={0}
      pointBorderWidth={2}
      pointBorderColor={{ from: "serieColor" }}
      pointLabelYOffset={-12}
      useMesh={true}
      enableGridX={false}
      enableGridY={true}
      gridYValues={[25]}
      enableCrosshair
      crosshairType={"top"}
      tooltip={Tooltip}
      colors={["#000000"]}
    />
  );
};
