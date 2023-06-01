BRANCH=$(printenv BRANCH)
STATE=$(printenv STATE)
VERCEL_TEAM_ID=$(printenv VERCEL_TEAM_ID)
VERCEL_TOKEN=$(printenv VERCEL_TOKEN)
VERCEL_PROJECT=$(printenv VERCEL_PROJECT)

deployments=$(
  curl \
  -X GET \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -s \
  "https://api.vercel.com/v6/deployments?teamId=$VERCEL_TEAM_ID&projectId=$VERCEL_PROJECT&limit=100&target=preview&state=$STATE"
)

matching=$(
  echo $deployments | jq -c '.deployments | map(select(.meta.githubCommitRef == "'"$BRANCH"'") | .url)'
)

for url in $(echo "${matching}" | jq -r .[]);
do
  echo Removing $url...

  curl \
  -X DELETE \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -s \
  "https://api.vercel.com/v13/deployments/undefined?teamId=$VERCEL_TEAM_ID&url=$url"

  sleep 2
done

echo Finished cleaning stale preview apps.
