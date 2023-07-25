if [ "$VERCEL_ENV" == "production" ];
then
  exit 1; 
elif [ -v $(git diff HEAD~3 HEAD --quiet ./packages/front-end) ];
then
  exit 1; 
else
  exit 0;
fi
