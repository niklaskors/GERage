import { Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as ses from "aws-cdk-lib/aws-ses";
import type { Construct } from "constructs";

export type EmailStackProps = StackProps & {
  /** The domain mail is sent from, e.g. gerage.niklaskors.com */
  domainName: string;
  /** The existing Route 53 hosted zone the domain lives in. */
  zoneName: string;
};

/**
 * Verified SES domain that Cognito sends its emails from.
 *
 * Lives in its own stack because Cognito only accepts a domain that SES has already verified,
 * and verification only finishes a few minutes after the DNS records exist.
 * All records are on the subdomain, so mail for the parent domain is unaffected.
 */
export class EmailStack extends Stack {
  constructor(scope: Construct, id: string, props: EmailStackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromLookup(this, "Zone", { domainName: props.zoneName });
    const mailFromDomain = `mail.${props.domainName}`;

    const identity = new ses.EmailIdentity(this, "Identity", {
      identity: ses.Identity.domain(props.domainName),
      mailFromDomain,
    });

    // DKIM: signs every mail, so receivers can check it really comes from this domain.
    // SES returns fully qualified names; the trailing dot stops Route 53 from appending the zone again.
    identity.dkimRecords.forEach(({ name, value }, i) => {
      new route53.CnameRecord(this, `DkimRecord${i + 1}`, { zone, recordName: `${name}.`, domainName: value });
    });

    // Custom MAIL FROM with SPF: bounces go to SES, and SES is the only allowed sender.
    new route53.MxRecord(this, "MailFromMx", {
      zone,
      recordName: mailFromDomain,
      values: [{ priority: 10, hostName: `feedback-smtp.${this.region}.amazonses.com` }],
    });
    new route53.TxtRecord(this, "MailFromSpf", {
      zone,
      recordName: mailFromDomain,
      values: ["v=spf1 include:amazonses.com -all"],
    });

    // DMARC: tells receivers to quarantine mail that claims to be from this domain but fails the checks.
    new route53.TxtRecord(this, "Dmarc", {
      zone,
      recordName: `_dmarc.${props.domainName}`,
      values: ["v=DMARC1; p=quarantine; adkim=s; aspf=r"],
      ttl: Duration.hours(1),
    });
  }
}
