import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  TextField,
  Link,
  Box,
  Icon,
  Divider,
  FormLayout,
  InlineError,
  Grid,
  ButtonGroup,
  InlineGrid,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { Form, useLoaderData, useSubmit } from "@remix-run/react";
import {
  ExternalIcon
} from '@shopify/polaris-icons';

export const loader = async ({ request }) => {
  const { admin, session, sessionToken } = await authenticate.admin(request);
  const clientId = process.env.SHOPIFY_API_KEY;
  const pearlbotBaseUrl = process.env.PEARLBOT_BASE_URL;
  const pearlbotApiUrl = process.env.PEARLBOT_API_URL || '';
  const response = await admin.graphql(
    `#graphqlsession
      query AccessScopeList {
        currentAppInstallation {
          id
        }
      }`,
  );
  const data = await response.json();
  const metaResponse = await admin.graphql(
    `#graphql
      query {
        currentAppInstallation {
          metafields(first: 2, namespace: "pearlbot") {
            edges {
              node {
                key
                value
              }
            }
          }
        }
      }`
  );

  const metafields = await metaResponse.json();
  let chatbotId = "";
  let apiKey = "";
  metafields.data.currentAppInstallation.metafields.edges.forEach(({ node }) => {
    if (node.key === "chatbot_id") chatbotId = node.value;
    if (node.key === "api_key") apiKey = node.value;
  });

  return {
    id: data.data.currentAppInstallation.id,
    session,
    metaData: {
      chatbotId,
      apiKey
    },
    config: {
      clientId,
      pearlbotApiUrl,
      pearlbotBaseUrl
    },
  };

};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const chatbotId = formData.get("chatbotId");
  const ownerId = formData.get("gid");
  const apiKey = formData.get("apiKey");
  const response = await admin.graphql(
    `#graphql
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            key
            namespace
            value
            createdAt
            updatedAt
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
    {
      variables: {
        "metafields": [
          {
            "namespace": "pearlbot",
            "key": "chatbot_id",
            "ownerId": ownerId,
            "type": "single_line_text_field",
            "value": chatbotId
          },
          {
            "namespace": "pearlbot",
            "key": "api_key",
            "ownerId": ownerId,
            "type": "single_line_text_field",
            "value": apiKey
          },
        ]
      },
    },
  );
  const data = await response.json();
  return data;
};

export default function Index() {
  const loaderData = useLoaderData();
  const submit = useSubmit();
  const { id: gid, session, config, metaData } = loaderData;
  const { clientId, pearlbotApiUrl, pearlbotBaseUrl } = config;
  const accountSettingsUrl = `${pearlbotBaseUrl}/dashboard#accountsettings`;
  const dashboardUrl = `${pearlbotBaseUrl}/dashboard`;
  const [chatbotId, setChatbotId] = useState(metaData?.chatbotId || "");
  const [apiKey, setApiKey] = useState(metaData?.apiKey || "");
  const [shopDomain, setShopDomain] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [chatbotIdError, setChatbotIdError] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  useEffect(() => {
    const app = useAppBridge();
    const shopDomain = app?.config?.shop;
    setShopDomain(shopDomain);
  }, []);

  const handleSubmit = (event) => {
    // event.preventDefault();

    let hasError = false;
    if (!chatbotId.trim()) {
      setChatbotIdError("ChatBot ID is required!");
      hasError = true;
    } else {
      setChatbotIdError("");
    }

    if (!apiKey.trim()) {
      setApiKeyError("API Key is required!");
      hasError = true;
    } else {
      setApiKeyError("");
    }

    if (!hasError) {
      submit({}, { replace: true, method: "POST" });
      shopify.toast.show("App settings saved.");
    }
  };

  const handleEnableAppEmbed = () => {
    const themeEditorUrl = `https://${shopDomain}/admin/themes/current/editor?context=apps&template=index&activateAppId=${process.env.SHOPIFY_PEARLBOT_ID}/chatbot-embed⁠`;
    window.open(themeEditorUrl, "_blank");
  };


  const handleConnectWithShopify = async () => {
    if (!session) {
      console.error("Session data is missing!");
      return;
    }

    if (!apiKey) {
      console.error("apiKey is missing!");
      return;
    }

    const postData = {
      botId: chatbotId,
      shop: session.shop,
      isOnline: session.isOnline,
      accessToken: session.accessToken,
    };
    console.log("postData:", postData);
    try {
      const response = await fetch(`${pearlbotApiUrl}/callback/storeShopifyAccessToken`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey
        },
        body: JSON.stringify(postData),
      });

      const data = await response.json();
      if (response.ok) {
        console.log("Shopify Access Token stored successfully:", data);
        shopify.toast.show("Connected with PearlBot!");
      } else {
        console.error("Error storing Shopify Access Token:", data);
        shopify.toast.show("Failed to connect.");
      }
    } catch (error) {
      console.error("API call to PearlBot failed:", error);
      shopify.toast.show("Connection error.");
    }
  };

  return (
    <Page fullWidth>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="600">
                <BlockStack gap="150">
                  <Text as="h2" variant="headingLg">Configuration Settings</Text>
                  <Divider />
                  <Text variant="bodyMd" color="subdued">
                    Configure your chatbot by entering the required credentials below.
                  </Text>
                </BlockStack>
                <BlockStack>
                  <Form method="post" onSubmit={handleSubmit}>
                    <FormLayout>
                      <TextField
                        name="chatbotId"
                        label="ChatBot ID"
                        requiredIndicator
                        value={chatbotId}
                        onChange={setChatbotId}
                        // autoComplete="off"
                        error={chatbotIdError}
                        helpText={
                          <Text variant="bodyMd" color="subdued">
                            Go to{" "}
                            <Link url={dashboardUrl} target="_blank">
                              Dashboard
                            </Link>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                margin: "0 5px",
                                justifyContent: "center",
                                verticalAlign: "top",
                              }}
                            >
                              <Icon source={ExternalIcon} color="subdued" />
                            </span>
                            Choose a chatbot &gt; General tab
                          </Text>
                          // </Box>
                        }
                      />
                      <TextField
                        name="apiKey"
                        label="API Key"
                        value={apiKey}
                        requiredIndicator
                        onChange={setApiKey}
                        type={apiKeyVisible ? "text" : "password"}
                        // autoComplete="off"
                        error={apiKeyError}
                        helpText={
                          <Text variant="bodyMd" color="subdued">
                            Go to{" "}
                            <Link url={accountSettingsUrl} target="_blank">
                              Account settings
                            </Link>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                margin: "0 5px",
                                justifyContent: "center",
                                verticalAlign: "top",
                              }}
                            >
                              <Icon source={ExternalIcon} color="subdued" />
                            </span>
                            &gt; General tab
                          </Text>
                        }
                        connectedRight={
                          <Button onClick={() => setApiKeyVisible(!apiKeyVisible)}>
                            {apiKeyVisible ? "Hide" : "Show"}
                          </Button>
                        }
                      />

                      <ButtonGroup>
                        <Button variant="primary" submit>Save</Button>
                        <Button onClick={handleEnableAppEmbed}>Enable chatbot in Theme</Button>
                      </ButtonGroup>
                      <input type="hidden" value={gid} name="gid" />
                    </FormLayout>
                  </Form>
                </BlockStack>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingLg">Shopify Integration</Text>
                <Text variant="bodyMd" color="subdued">
                  Connect your Shopify store to enable advanced e-commerce features.
                </Text>
                <ButtonGroup>

                <Button onClick={handleConnectWithShopify} >
                  Connect with Shopify
                </Button>
                </ButtonGroup>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
        </Layout.Section>
      </Layout>
    </Page>
  );
}