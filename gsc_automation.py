"""
Google Search Console Automation
Site: floatswim.org
Credentials: .gsc-credentials/laptoplane-blogspot-autoposter-c7da82883623.json

USAGE EXAMPLES:
  python gsc_automation.py                        # top queries (default)
  python gsc_automation.py --report queries       # top queries
  python gsc_automation.py --report pages         # top pages
  python gsc_automation.py --report summary       # overall stats
  python gsc_automation.py --report all           # run all reports
  python gsc_automation.py --days 7               # change date range (default: 28)
  python gsc_automation.py --report queries --days 90 --limit 25
"""

import argparse
from datetime import date, timedelta
from google.oauth2 import service_account
from googleapiclient.discovery import build

# --- Config ---
KEY_FILE     = ".gsc-credentials/laptoplane-blogspot-autoposter-c7da82883623.json"
PROPERTY_URL = "sc-domain:floatswim.org"
SCOPES       = ["https://www.googleapis.com/auth/webmasters.readonly"]


def get_service():
    creds = service_account.Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)
    return build("searchconsole", "v1", credentials=creds)


def date_range(days):
    end   = date.today() - timedelta(days=3)
    start = end - timedelta(days=days)
    return str(start), str(end)


def query_gsc(service, dimensions, days, limit):
    start, end = date_range(days)
    body = {
        "startDate":  start,
        "endDate":    end,
        "dimensions": dimensions,
        "rowLimit":   limit,
        "orderBy":    [{"fieldName": "impressions", "sortOrder": "DESCENDING"}]
    }
    response = service.searchanalytics().query(siteUrl=PROPERTY_URL, body=body).execute()
    return response.get("rows", []), start, end


def report_summary(service, days, limit):
    rows, start, end = query_gsc(service, ["date"], days, 90)
    if not rows:
        print("No data available for this period.")
        return
    total_clicks      = sum(r["clicks"]      for r in rows)
    total_impressions = sum(r["impressions"] for r in rows)
    avg_ctr           = (total_clicks / total_impressions * 100) if total_impressions else 0
    avg_position      = sum(r["position"] for r in rows) / len(rows) if rows else 0
    print(f"\n{'='*50}")
    print(f"  SUMMARY  |  {start} to {end}")
    print(f"{'='*50}")
    print(f"  Total Clicks      : {total_clicks:,}")
    print(f"  Total Impressions : {total_impressions:,}")
    print(f"  Avg CTR           : {avg_ctr:.2f}%")
    print(f"  Avg Position      : {avg_position:.1f}")
    print(f"{'='*50}\n")


def report_queries(service, days, limit):
    rows, start, end = query_gsc(service, ["query"], days, limit)
    if not rows:
        print("No query data available.")
        return
    print(f"\nTop {len(rows)} Queries  |  {start} to {end}\n")
    print(f"{'#':<4} {'Query':<45} {'Clicks':>7} {'Impr':>8} {'CTR':>7} {'Pos':>8}")
    print("-" * 83)
    for i, row in enumerate(rows, 1):
        q = row["keys"][0][:44]
        print(f"{i:<4} {q:<45} {row['clicks']:>7.0f} {row['impressions']:>8.0f} "
              f"{row['ctr']:>6.1%} {row['position']:>8.1f}")
    print()


def report_pages(service, days, limit):
    rows, start, end = query_gsc(service, ["page"], days, limit)
    if not rows:
        print("No page data available.")
        return
    print(f"\nTop {len(rows)} Pages  |  {start} to {end}\n")
    print(f"{'#':<4} {'Page':<50} {'Clicks':>7} {'Impr':>8} {'CTR':>7} {'Pos':>8}")
    print("-" * 82)
    for i, row in enumerate(rows, 1):
        page = row["keys"][0].replace("https://floatswim.org", "")[:49] or "/"
        print(f"{i:<4} {page:<50} {row['clicks']:>7.0f} {row['impressions']:>8.0f} "
              f"{row['ctr']:>6.1%} {row['position']:>8.1f}")
    print()


def main():
    parser = argparse.ArgumentParser(description="GSC Automation - floatswim.org")
    parser.add_argument("--report", choices=["queries", "pages", "summary", "all"],
                        default="queries", help="Report type (default: queries)")
    parser.add_argument("--days",  type=int, default=28,
                        help="Number of days to look back (default: 28)")
    parser.add_argument("--limit", type=int, default=10,
                        help="Max rows to return (default: 10)")
    args = parser.parse_args()

    print(f"Connecting to GSC for {PROPERTY_URL}...")
    service = get_service()
    print("Connected.\n")

    if args.report == "all":
        report_summary(service, args.days, args.limit)
        report_queries(service, args.days, args.limit)
        report_pages(service, args.days, args.limit)
    elif args.report == "summary":
        report_summary(service, args.days, args.limit)
    elif args.report == "pages":
        report_pages(service, args.days, args.limit)
    else:
        report_queries(service, args.days, args.limit)


if __name__ == "__main__":
    main()
