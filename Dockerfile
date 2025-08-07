# Use FlareSolverr as base (it's basically the same as Byparr)
FROM ghcr.io/flaresolverr/flaresolverr:latest

# Expose port
EXPOSE 8191

# Start command
CMD ["python", "src/flaresolverr.py"]
