# Task 90: Docker Configuration - Backend
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY backend/backend.csproj backend/
RUN dotnet restore backend/backend.csproj
COPY backend/ backend/
RUN dotnet publish backend/backend.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app .

# Create asset directories
RUN mkdir -p "Assets" "Assets Library"

EXPOSE 5243
ENV ASPNETCORE_URLS=http://+:5243
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "backend.dll"]
