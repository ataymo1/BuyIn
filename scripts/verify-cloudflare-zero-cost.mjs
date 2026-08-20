const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const zeroCostAccountId = process.env.CLOUDFLARE_ZERO_COST_ACCOUNT_ID;
const acknowledgement = process.env.CLOUDFLARE_ZERO_COST_ACK;
const billingReadToken = process.env.CLOUDFLARE_BILLING_READ_TOKEN;

const failures = [];
if (!accountId) {
  failures.push("CLOUDFLARE_ACCOUNT_ID must select the deployment account explicitly");
}
if (!zeroCostAccountId) {
  failures.push(
    "CLOUDFLARE_ZERO_COST_ACCOUNT_ID must identify the dedicated Workers Free account"
  );
}
if (accountId && zeroCostAccountId && accountId !== zeroCostAccountId) {
  failures.push("the selected account is not the approved zero-cost account");
}
if (acknowledgement !== "workers-free-hard-limits") {
  failures.push(
    "CLOUDFLARE_ZERO_COST_ACK must equal workers-free-hard-limits after verifying the account is still on Workers Free"
  );
}
if (!billingReadToken) {
  failures.push(
    "CLOUDFLARE_BILLING_READ_TOKEN must be an account-scoped token with Billing Read permission"
  );
}

if (failures.length > 0) {
  console.error(`Cloudflare deployment blocked:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

function blockDeployment(message) {
  console.error(`Cloudflare deployment blocked: ${message}`);
  process.exit(1);
}

async function getAllSubscriptions() {
  const subscriptions = [];
  let expectedTotal = null;
  for (let page = 1; page <= 100; page += 1) {
    const url = new URL(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/subscriptions`
    );
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "50");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${billingReadToken}` },
    });
    if (!response.ok) {
      blockDeployment(
        `unable to verify subscriptions (HTTP ${response.status})`
      );
    }

    const body = await response.json();
    if (!(body.success && Array.isArray(body.result))) {
      blockDeployment("the subscriptions API returned an invalid response");
    }
    const totalCount = Number(body.result_info?.total_count);
    if (!(Number.isSafeInteger(totalCount) && totalCount >= 0)) {
      blockDeployment("the subscriptions API omitted its total result count");
    }
    if (expectedTotal === null) {
      expectedTotal = totalCount;
    } else if (expectedTotal !== totalCount) {
      blockDeployment("the subscription count changed during verification");
    }
    subscriptions.push(...body.result);
    if (subscriptions.length >= expectedTotal) {
      if (subscriptions.length !== expectedTotal) {
        blockDeployment("the subscriptions API returned inconsistent paging");
      }
      return subscriptions;
    }
    if (body.result.length === 0) {
      blockDeployment("the subscriptions API returned an incomplete page");
    }
  }
  blockDeployment("the subscriptions API exceeded 100 pages");
}

const subscriptions = await getAllSubscriptions();
const inactiveStates = new Set(["cancelled", "expired", "inactive"]);
const paidSubscriptions = subscriptions.filter((subscription) => {
  const state = String(subscription.state ?? "").toLowerCase();
  if (inactiveStates.has(state)) {
    return false;
  }
  const plan = `${subscription.rate_plan?.id ?? ""} ${
    subscription.rate_plan?.public_name ?? ""
  }`.toLowerCase();
  const isExplicitlyFree =
    Number(subscription.price ?? 0) === 0 && plan.includes("free");
  return !isExplicitlyFree;
});

if (paidSubscriptions.length > 0) {
  const plans = paidSubscriptions
    .map(
      (subscription) =>
        subscription.rate_plan?.public_name ??
        subscription.rate_plan?.id ??
        subscription.id ??
        "unknown plan"
    )
    .join(", ");
  console.error(
    `Cloudflare deployment blocked: paid or non-Free account subscription detected (${plans}).`
  );
  process.exit(1);
}

console.log(
  "Cloudflare zero-cost deployment guard passed: account IDs match and no paid subscription was reported."
);
