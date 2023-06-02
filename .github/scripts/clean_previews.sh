BRANCH=$(printenv BRANCH)
STATE=$(printenv STATE)
VERCEL_TEAM_ID=$(printenv VERCEL_TEAM_ID)
VERCEL_TOKEN=$(printenv VERCEL_TOKEN)
VERCEL_PROJECT=$(printenv VERCEL_PROJECT)

IFS=$' \t\r\n'

deployments=$(
  curl \
  -X GET \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -s \
  "https://api.vercel.com/v6/deployments?teamId=$VERCEL_TEAM_ID&projectId=$VERCEL_PROJECT&limit=100&target=preview&state=$STATE"
)

matching=$(
  echo $deployments | jq -c '.deployments | map(select(.meta.githubCommitRef == "'"$BRANCH"'") | .uid)'
)

for uid in $(echo "${matching}" | jq -r .[] | xargs);
do 
  echo "Removing deployment..."

  curl \
  -X DELETE \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -s \
  "https://api.vercel.com/v13/deployments/$uid?teamId=$VERCEL_TEAM_ID"

  sleep 2
  echo $'\n'
done

echo Finished cleaning stale preview apps.
