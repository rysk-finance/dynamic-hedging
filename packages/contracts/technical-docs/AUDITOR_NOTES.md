# Auditor notes

## executeEpochCalculation

In this function you will notice that there is a TODO: ```   // TODO: Maybe change this so it checks the request Id instead of validating by price and time check that the portfolio values are acceptable``` The intention here is to make this function a publicly callable function so anyone can resume an epoch once the system is paused. We would like to know if this is sensible given the sensitivity of the function and your opinions on the solution proposed in the TODO as a way of allowing this function to be publicly callable so as to remove the ability for governance to freeze all activity deposits and withdraws indefinitely.